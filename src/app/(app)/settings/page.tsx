import { Suspense } from "react";

import { User, Target } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/features/settings/profile-form";
import { AvatarUploader } from "@/components/features/settings/avatar-uploader";
import {
  StudyAreaEditor,
  type AreaItem,
} from "@/components/features/settings/study-area-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";


export const metadata = { title: "Configurações" };

async function SettingsContent() {
  const user = await requireUser();
  const supabase = await createClient();

  const [profileRes, areasRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, avatar_url, weekly_goal_min, timezone")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("study_areas")
      .select("id, name, target_type, exam_board, exam_date")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const profile = profileRes.data;
  const areas = (areasRes.data ?? []) as AreaItem[];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Ajuste suas preferências de estudo e seus dados.
        </p>
      </div>

      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle className="text-base">Foto de perfil</CardTitle>
          <CardDescription>
            Sua imagem aparece na barra lateral e no menu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUploader
            name={profile?.name || user.name}
            avatarUrl={profile?.avatar_url ?? user.avatarUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-4" />
            Perfil e metas
          </CardTitle>
          <CardDescription>
            A meta semanal alimenta o dashboard e a geração de ciclos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            name={profile?.name || user.name}
            weeklyGoalMin={profile?.weekly_goal_min ?? 1200}
            timezone={profile?.timezone ?? "America/Sao_Paulo"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="size-4" />
            Áreas de estudo
          </CardTitle>
          <CardDescription>
            Concursos e vestibulares que você está estudando.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {areas.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Nenhuma área criada. Crie uma na página do Edital.
            </p>
          ) : (
            areas.map((area) => <StudyAreaEditor key={area.id} area={area} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conta</CardTitle>
          <CardDescription>Dados da sua autenticação.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">E-mail</span>
            <span className="truncate font-medium">{user.email ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">ID</span>
            <span className="text-muted-foreground truncate font-mono text-xs">
              {user.id}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
