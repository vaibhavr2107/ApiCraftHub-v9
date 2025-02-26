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
        onValueChange={(value: "none" | "basic" | "bearer" | "bearer-tiaa" | "oauth2") =>
          onChange({
            type: value,
            ...(value === "basic"
              ? { basic: { username: "", password: "" } }
              : value === "bearer"
              ? { bearer: { token: "" } }
              : value === "bearer-tiaa"
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
          <SelectItem value="bearer-tiaa">Bearer Token with TIAA</SelectItem>
          <SelectItem value="oauth2">OAuth 2.0</SelectItem>
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

      {(auth.type === "bearer" || auth.type === "bearer-tiaa") && (
        <Input
          placeholder={auth.type === "bearer-tiaa" ? "Token will be fetched automatically" : "Bearer Token"}
          value={auth.bearer?.token || ""}
          onChange={(e) =>
            onChange({
              ...auth,
              bearer: { token: e.target.value }
            })
          }
          disabled={auth.type === "bearer-tiaa"}
        />
      )}

      {auth.type === "oauth2" && (
        <div className="text-sm text-muted-foreground">
          OAuth 2.0 configuration will be implemented soon
        </div>
      )}
    </div>
  );
}