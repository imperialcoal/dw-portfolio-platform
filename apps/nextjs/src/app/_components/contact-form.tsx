"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

export function ContactForm() {
  const trpc = useTRPC();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const { mutate, isPending, error } = useMutation(
    trpc.contact.send.mutationOptions({
      onSuccess: () => {
        setSubmitted(true);
        setForm({ name: "", email: "", message: "" });
      },
    }),
  );

  return (
    <section className="border-border/60 border-t">
      <div className="mx-auto max-w-xl px-6 py-16 lg:px-10">
        <div className="mb-8 text-center">
          <h2 className="text-foreground text-xl font-bold tracking-tight">
            Interested in the work?
          </h2>
          <p className="text-muted-foreground mt-3 text-sm">
            Reach out directly — this form sends via{" "}
            <span className="text-foreground font-medium">Resend</span>, one of
            the live services powering this platform.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-6 py-8 text-center dark:bg-emerald-500/10">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              ✓ Message sent — I'll get back to you soon.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-border/80 focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus:ring-2"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-border/80 focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus:ring-2"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
            <textarea
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-border/80 focus:ring-ring/20 w-full resize-none rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus:ring-2"
              placeholder="Message"
              rows={4}
              value={form.message}
              onChange={(e) =>
                setForm((f) => ({ ...f, message: e.target.value }))
              }
            />
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">
                Something went wrong. Please try again.
              </p>
            )}
            <button
              className="mt-1 w-full rounded-lg border border-emerald-600/40 bg-emerald-700/80 px-4 py-2.5 text-sm font-medium text-emerald-50 transition-opacity hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-600/20 dark:text-emerald-300 dark:hover:bg-emerald-600/30"
              disabled={isPending}
              onClick={() => mutate(form)}
            >
              {isPending ? "Sending…" : "Send Message"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
