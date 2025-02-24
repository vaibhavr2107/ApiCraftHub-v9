import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { RequestAuth } from "@/types/api-request";

interface AuthorizationSectionProps {
  auth: RequestAuth;
  onChange: (auth: RequestAuth) => void;
}

export function AuthorizationSection({ auth, onChange }: AuthorizationSectionProps) {
  return (
    <div className="space-y-4">
      <Select
        value={auth.type}
        onValueChange={(value: "none" | "basic" | "bearer") =>
          onChange({
            type: value,
            ...(value === "basic"
              ? { basic: { username: "", password: "" } }
              : value === "bearer"
              ? { bearer: { token: "" } }
              : {})
          })
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select auth type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No Auth</SelectItem>
          <SelectItem value="basic">Basic Auth</SelectItem>
          <SelectItem value="bearer">Bearer Token</SelectItem>
        </SelectContent>
      </Select>

      {auth.type === "basic" && (
        <div className="space-y-2">
          <Input
            placeholder="Username"
            value={auth.basic?.username || ""}
            onChange={(e) =>
              onChange({
                ...auth,
                basic: {
                  ...auth.basic,
                  username: e.target.value,
                  password: auth.basic?.password || ""
                }
              })
            }
          />
          <Input
            type="password"
            placeholder="Password"
            value={auth.basic?.password || ""}
            onChange={(e) =>
              onChange({
                ...auth,
                basic: {
                  ...auth.basic,
                  username: auth.basic?.username || "",
                  password: e.target.value
                }
              })
            }
          />
        </div>
      )}

      {auth.type === "bearer" && (
        <Input
          placeholder="Bearer Token"
          value={auth.bearer?.token || ""}
          onChange={(e) =>
            onChange({
              ...auth,
              bearer: { token: e.target.value }
            })
          }
        />
      )}
    </div>
  );
}
