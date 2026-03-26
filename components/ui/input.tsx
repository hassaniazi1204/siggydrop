import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base
          "flex w-full bg-black/50 text-white placeholder:text-white/30",
          "border border-white/10 rounded-xl px-4 py-3 text-sm font-medium",
          "transition-all duration-200",
          // Focus — green ring matching brand
          "focus:outline-none focus:border-[#40FFAF]/60 focus:ring-2 focus:ring-[#40FFAF]/20",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-40",
          // Font mono for codes
          "font-[family-name:var(--font-barlow)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
