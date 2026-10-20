"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { UserIcon } from "@/components/icons";
import {
  Alert,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/ui";
import { apiRequest } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

export function ProfileForm({ initialProfile }: { initialProfile: Profile }) {
  const router = useRouter();
  const [name, setName] = useState(initialProfile.name);
  const [image, setImage] = useState(initialProfile.image ?? "");
  const [phone, setPhone] = useState(initialProfile.phone ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest<{ profile: Profile }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ name, image: image || null, phone: phone || null }),
      });
      setMessage("Profile updated.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update your profile.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-accent ring-1 ring-accent-border">
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="64px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <UserIcon className="h-7 w-7" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {initialProfile.name}
          </p>
          <p className="truncate text-sm text-muted-soft">
            {initialProfile.email}
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="profile-name" className={labelClass}>
          Name
        </label>
        <input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="profile-email" className={labelClass}>
          Email
        </label>
        <input
          id="profile-email"
          value={initialProfile.email}
          readOnly
          className={`${inputClass} bg-surface-muted text-muted-soft`}
        />
        <p className="mt-1.5 text-xs text-muted-soft">
          Email changes are handled by the authentication provider and are not
          editable here.
        </p>
      </div>

      <div>
        <label htmlFor="profile-phone" className={labelClass}>
          Phone <span className="font-normal text-faint">(optional)</span>
        </label>
        <input
          id="profile-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          maxLength={40}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="profile-image" className={labelClass}>
          Avatar image URL{" "}
          <span className="font-normal text-faint">(optional)</span>
        </label>
        <input
          id="profile-image"
          value={image}
          onChange={(event) => setImage(event.target.value)}
          maxLength={1000}
          placeholder="https://example.com/avatar.jpg"
          className={inputClass}
        />
      </div>

      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
        {isSubmitting ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
