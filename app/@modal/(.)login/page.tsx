"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/app/components/ui/dialog";
import { LoginContent } from "@/app/(auth)/_components/LoginContent";

export default function LoginModal() {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={() => router.back()}>
      <DialogContent>
        <LoginContent />
      </DialogContent>
    </Dialog>
  );
}
