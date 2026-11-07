"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type AvatarState =
  | { error?: string; success?: string; url?: string }
  | undefined;

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB (mesmo limite do bucket)
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Envia a foto de perfil para o bucket `avatars` e atualiza `profiles.avatar_url`.
 *
 * O arquivo fica em `avatars/<uid>/avatar-<timestamp>.<ext>`. O timestamp no
 * nome evita cache antigo do navegador ao trocar a foto.
 */
export async function uploadAvatar(formData: FormData): Promise<AvatarState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione uma imagem." };
  }
  if (!ALLOWED.includes(file.type)) {
    return { error: "Formato inválido. Use PNG, JPG, WEBP ou GIF." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Imagem muito grande (máximo 2 MB)." };
  }

  const ext = EXT[file.type] ?? "png";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    return { error: `Não foi possível enviar a imagem: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateError) {
    return { error: "Imagem enviada, mas não foi possível salvar no perfil." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { success: "Foto atualizada!", url: publicUrl };
}

/** Remove a foto de perfil. */
export async function removeAvatar(): Promise<AvatarState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sessão expirada. Entre novamente." };

  // Remove todos os arquivos da pasta do usuário (best-effort).
  const { data: files } = await supabase.storage.from("avatars").list(user.id);
  if (files && files.length > 0) {
    await supabase.storage
      .from("avatars")
      .remove(files.map((f) => `${user.id}/${f.name}`));
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) return { error: "Não foi possível remover a foto." };

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { success: "Foto removida." };
}
