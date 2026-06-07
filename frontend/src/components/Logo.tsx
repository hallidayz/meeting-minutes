import React from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { VisuallyHidden } from "./ui/visually-hidden";
import { About } from "./About";
import { BRAND } from "@/config/branding";

interface LogoProps {
    isCollapsed: boolean;
}

const Logo = React.forwardRef<HTMLButtonElement, LogoProps>(({ isCollapsed }, ref) => {
  return (
    <Dialog aria-describedby={undefined}>
      {isCollapsed ? (
        <DialogTrigger asChild>
          <button ref={ref} className="flex items-center justify-start mb-2 cursor-pointer bg-transparent border-none p-0 hover:opacity-80 transition-opacity">
            <Image src="/brand/logo.png" alt={BRAND.name} width={40} height={40} className="rounded" />
          </button>
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <button
            ref={ref}
            type="button"
            className="flex flex-col items-start gap-1 mb-2 cursor-pointer bg-transparent border-none p-0 hover:opacity-90 transition-opacity text-left"
          >
            <Image src="/brand/logo.png" alt={BRAND.name} width={120} height={48} className="rounded" />
            <span className="text-xs tracking-widest text-brand-primary font-semibold">{BRAND.taglinePrimary}</span>
          </button>
        </DialogTrigger>
      )}
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle>About {BRAND.shortName}</DialogTitle>
        </VisuallyHidden>
        <About />
      </DialogContent>
    </Dialog>
  );
});

Logo.displayName = "Logo";

export default Logo;
