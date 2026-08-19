import { redirect } from "next/navigation";

/** Temporary: skip the ingest landing page and go straight to admin. */
export default function HomePage() {
  redirect("/dashboard");
}
