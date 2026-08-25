"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface ComingSoonProviderCardProps {
  name: string;
  icon: LucideIcon;
  description: string;
}

export function ComingSoonProviderCard({
  name,
  icon: Icon,
  description,
}: ComingSoonProviderCardProps) {
  const switchId = useId();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">{name}</CardTitle>
        </div>
        <Badge variant="outline">Coming soon</Badge>
      </CardHeader>
      <CardContent className="pointer-events-none space-y-4 opacity-60">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Enabled</span>
          <Switch
            id={switchId}
            checked={false}
            disabled
            onCheckedChange={() => {}}
          />
        </div>
      </CardContent>
    </Card>
  );
}
