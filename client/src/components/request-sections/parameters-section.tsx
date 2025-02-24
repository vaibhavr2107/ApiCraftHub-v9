import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { RequestParameter } from "@/types/api-request";

interface ParametersSectionProps {
  title: string;
  parameters: RequestParameter[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof RequestParameter, value: string | boolean) => void;
}

export function ParametersSection({
  title,
  parameters,
  onAdd,
  onRemove,
  onChange,
}: ParametersSectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="space-y-2">
        {parameters.map((param, index) => (
          <div key={index} className="parameter-grid">
            <Checkbox
              checked={param.enabled}
              onCheckedChange={(checked) =>
                onChange(index, "enabled", checked === true)
              }
            />
            <Input
              placeholder="Key"
              value={param.key}
              onChange={(e) => onChange(index, "key", e.target.value)}
              className="parameter-input"
            />
            <Input
              placeholder="Value"
              value={param.value}
              onChange={(e) => onChange(index, "value", e.target.value)}
              className="parameter-input"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button onClick={onAdd} variant="outline" size="sm" className="w-full">
          Add {title}
        </Button>
      </div>
    </div>
  );
}
