"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/app/components/ui/dialog";
import { CadastrarContent } from "@/app/(auth)/_components/CadastrarContent";

export default function CadastrarModal() {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={() => router.back()}>
      <DialogContent>
        <CadastrarContent />
      </DialogContent>
    </Dialog>
  );
}
