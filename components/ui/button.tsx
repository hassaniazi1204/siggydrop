import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base — shared across all variants
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold uppercase tracking-widest transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-40 active:scale-95",
  {
    variants: {
      variant: {
        // Primary green — main CTA (Start Quiz, Play as Guest)
        primary:
          "bg-[#40FFAF] text-black hover:bg-[#2deba0] hover:shadow-[0_0_24px_rgba(64,255,175,0.5)] focus-visible:ring-[#40FFAF]",
        // Purple — secondary CTA (Play Game, Sign Up)
        purple:
          "bg-[#8840FF] text-white hover:bg-[#7030e0] hover:shadow-[0_0_24px_rgba(136,64,255,0.5)] focus-visible:ring-[#8840FF]",
        // Ghost — low-emphasis (Sign Out, Back)
        ghost:
          "bg-white/8 text-white/70 border border-white/15 hover:bg-white/14 hover:text-white focus-visible:ring-white/30",
        // Outline green — nav links (Leaderboard)
        outline:
          "bg-[#40FFAF]/10 text-[#40FFAF] border border-[#40FFAF]/35 hover:bg-[#40FFAF]/20 focus-visible:ring-[#40FFAF]",
        // Danger — destructive actions
        danger:
          "bg-transparent text-red-400 border border-red-500/30 hover:bg-red-500/10 hover:border-red-400/60 focus-visible:ring-red-500",
        // Discord brand
        discord:
          "bg-[#5865F2] text-white hover:bg-[#4752C4] hover:shadow-[0_0_20px_rgba(88,101,242,0.4)] focus-visible:ring-[#5865F2]",
        // Google brand
        google:
          "bg-white text-gray-800 hover:bg-gray-100 hover:shadow-md focus-visible:ring-gray-300",
      },
      size: {
        sm:   "h-9  px-4  text-xs  rounded-lg",
        md:   "h-11 px-6  text-sm  rounded-xl",
        lg:   "h-14 px-10 text-base rounded-xl",
        xl:   "h-16 px-14 text-lg  rounded-xl",
        icon: "h-9  w-9          rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size:    "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
