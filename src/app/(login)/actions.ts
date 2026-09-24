"use server";

import { createClient } from "@/lib/db-server";
import { redirect } from "next/navigation";

export async function login(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function signup(formData: FormData): Promise<{ error?: string; success?: boolean; message?: string }> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm-password") as string;

  if (!email || !password || !name) {
    return { error: "All fields are required" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const db = await createClient();
  const { error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "Account created successfully!" };
}

export async function logout() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/sign-in");
}
