"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, supabaseEnv } from "@/lib/supabaseClient";

const adminEmails =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean) ?? [];

export default function AdminNav() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const email = sessionData.session?.user.email?.toLowerCase();

      if (email && adminEmails.includes(email)) {
        setIsAdmin(true);
        return;
      }

      if (!accessToken || !supabaseEnv.url || !supabaseEnv.key) {
        setIsAdmin(false);
        return;
      }

      try {
        const response = await fetch(
          `${supabaseEnv.url}/functions/v1/adminUsers`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              apikey: supabaseEnv.key,
            },
            body: JSON.stringify({ action: "list" }),
          }
        );
        setIsAdmin(response.ok);
      } catch {
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, []);

  if (!isAdmin) return null;

  return (
    <Link href="/admin" className="admin-link">
      Admin
    </Link>
  );
}
