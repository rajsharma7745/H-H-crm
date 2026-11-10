"use client";

import { useCallback, useTransition, type FormEvent } from "react";

/**
 * Submit handler that runs a server action *without* React 19's automatic
 * form reset.
 *
 * `<form action={fn}>` resets every uncontrolled field to its default once the
 * action settles — including when it returns a validation/application error,
 * which wiped everything the user had typed. Calling the action from onSubmit
 * inside a transition keeps the entered values on screen for a failed save
 * (a successful save closes the dialog, so there is nothing to keep).
 * Client-side `required`/`maxLength` validation still runs before onSubmit.
 */
export function usePreservedSubmit(formAction: (formData: FormData) => void) {
  const [, startTransition] = useTransition();
  return useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      startTransition(() => formAction(formData));
    },
    [formAction],
  );
}
