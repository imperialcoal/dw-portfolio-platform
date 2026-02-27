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

  if (submitted) {
    return (
      <p className="text-center text-sm text-green-600">
        Message sent! I'll get back to you soon.
      </p>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <input
        className="rounded border p-2"
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />
      <input
        className="rounded border p-2"
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
      />
      <textarea
        className="rounded border p-2"
        placeholder="Message"
        rows={5}
        value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
      />
      {error && (
        <p className="text-sm text-red-500">
          Something went wrong. Please try again.
        </p>
      )}
      <button
        className="bg-primary rounded p-2 text-white disabled:opacity-50"
        disabled={isPending}
        onClick={() => mutate(form)}
      >
        {isPending ? "Sending..." : "Send Message"}
      </button>
    </div>
  );
}
