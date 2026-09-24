"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signup } from "@/app/(login)/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await signup(formData);

    if (result?.error) {
      toast.error(result.error);
      setPending(false);
    } else {
      toast.success(result.message || "Account created successfully!");
      setMessage(result.message || "Account created successfully!");
      setPending(false);
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="shadow-md">
        <CardHeader className="py-3 text-center">
          <CardTitle className="text-xl font-bold">
            Create your account
          </CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent className="mx-2">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <div className="relative w-full">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="shadow-xs h-9 pl-9 pr-3 rounded-md border-foreground/20"
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Full Name"
                    required
                  />
                </div>
              </Field>
              <Field>
                <div className="relative w-full">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="shadow-xs h-9 pl-9 pr-3 rounded-md border-foreground/20"
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Email"
                    required
                  />
                </div>
              </Field>
              <Field>
                <div className="relative w-full">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="shadow-xs h-9 pl-9 pr-9 rounded-md border-foreground/20"
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
              <Field>
                <div className="relative w-full">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="shadow-xs h-9 pl-9 pr-9 rounded-md border-foreground/20"
                    id="confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
              <FieldDescription className="text-xs -mt-1 pl-1">
                Must be at least 8 characters long.
              </FieldDescription>


              <Field className="gap-3">
                {message ? (
                  <Button asChild className="shadow-sm rounded-full h-10 mt-2 border-none w-full">
                    <a href="/sign-in">Back to Sign in</a>
                  </Button>
                ) : (
                  <Button type="submit" disabled={pending} className="shadow-sm rounded-full h-10 mt-2 border-none">
                    {pending ? "Creating Account..." : "Create Account"}
                  </Button>
                )}
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="py-4 mt-2">
          <FieldDescription className="w-full text-center">
            Already have an account? <a href="/sign-in">Sign in</a>
          </FieldDescription>
        </CardFooter>
      </Card>
    </div>
  );
}
