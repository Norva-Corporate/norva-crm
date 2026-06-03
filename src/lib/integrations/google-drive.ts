import "server-only";
import { getValidGoogleAccessToken } from "./google-oauth";

// ============================================================
// Google Drive helpers — Phase C (039)
// ============================================================
// Crée un dossier racine pour un deal ou un projet, avec des
// sous-dossiers métier (Brief / Devis / Contrat — Livrables / Specs
// / Communication). Utilise le scope OAuth `drive.file` qui ne donne
// accès qu'aux fichiers/dossiers créés par cette app (l'utilisateur
// reste maître du reste de son Drive).
// ============================================================

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

interface DriveError {
  status: number;
  reason?: string;
  body: string;
}

async function driveFetch(
  path: string,
  init: RequestInit & { token: string }
): Promise<Response> {
  const { token, ...rest } = init;
  return fetch(`${DRIVE_BASE}${path}`, {
    ...rest,
    headers: {
      ...(rest.headers ?? {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
}

async function readDriveError(res: Response): Promise<DriveError> {
  const body = await res.text().catch(() => "");
  let reason: string | undefined;
  try {
    const json = JSON.parse(body) as {
      error?: { errors?: { reason?: string }[] };
    };
    reason = json.error?.errors?.[0]?.reason;
  } catch {
    /* ignore */
  }
  return { status: res.status, reason, body };
}

export interface CreatedFolder {
  id: string;
  webViewLink: string;
}

/**
 * Crée un dossier Drive (optionnellement sous un parent) et retourne
 * son id + son webViewLink. Si `parentId` est fourni, le dossier est
 * créé à l'intérieur ; sinon il atterrit dans "Mon Drive".
 */
async function createFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<CreatedFolder> {
  const body = JSON.stringify({
    name,
    mimeType: "application/vnd.google-apps.folder",
    ...(parentId ? { parents: [parentId] } : {}),
  });
  const res = await driveFetch("/files?fields=id,webViewLink", {
    method: "POST",
    token,
    body,
  });
  if (!res.ok) {
    const err = await readDriveError(res);
    throw new Error(`drive files.create failed: ${err.status} ${err.body}`);
  }
  const json = (await res.json()) as { id: string; webViewLink: string };
  return { id: json.id, webViewLink: json.webViewLink };
}

/**
 * Crée un dossier racine + N sous-dossiers en parallèle.
 * Renvoie le couple { id, webViewLink } du dossier racine.
 */
async function createFolderWithSubfolders(
  userId: string,
  rootName: string,
  subfolders: string[],
  parentId?: string
): Promise<CreatedFolder> {
  const { token } = await getValidGoogleAccessToken(userId);
  const root = await createFolder(token, rootName, parentId);
  await Promise.all(
    subfolders.map((name) => createFolder(token, name, root.id))
  );
  return root;
}

/**
 * Crée un dossier pour un deal : structure pré-vente.
 * `01-Brief / 02-Devis / 03-Contrat`.
 */
export async function createDealDriveFolder(
  userId: string,
  dealTitle: string,
  parentId?: string
): Promise<CreatedFolder> {
  const rootName = `[Deal] ${dealTitle}`.slice(0, 200);
  return createFolderWithSubfolders(
    userId,
    rootName,
    ["01-Brief", "02-Devis", "03-Contrat"],
    parentId
  );
}

/**
 * Crée un dossier pour un projet : structure delivery.
 * `01-Livrables / 02-Spécifications / 03-Communication`.
 */
export async function createProjectDriveFolder(
  userId: string,
  projectName: string,
  parentId?: string
): Promise<CreatedFolder> {
  const rootName = `[Projet] ${projectName}`.slice(0, 200);
  return createFolderWithSubfolders(
    userId,
    rootName,
    ["01-Livrables", "02-Spécifications", "03-Communication"],
    parentId
  );
}
