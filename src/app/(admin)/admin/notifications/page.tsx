import { redirect } from "next/navigation";

export default function NotificationsIndex() {
  redirect("/admin/notifications/history");
}
