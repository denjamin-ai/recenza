// Публичный/читательский сегмент: шапка сайта видна (AppFrame). Без гейтинга — открыт гостям.
import { AppFrame } from "@/components/nav/app-frame";

export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
