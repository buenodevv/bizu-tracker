import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
  bullets,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  bullets: string[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <Badge variant="secondary">Em breve</Badge>
        </div>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="flex-row items-center gap-3">
          <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
            <Icon className="size-5" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>Esta tela está no roadmap.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span className="text-foreground">•</span>
                {b}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
