import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        gold: "border-transparent bg-brand-gold text-white",
        critico: "border-transparent bg-red-600 text-white",
        alto: "border-transparent bg-orange-500 text-white",
        medio: "border-transparent bg-yellow-500 text-white",
        bajo: "border-transparent bg-green-600 text-white",
        nueva: "border-transparent bg-blue-600 text-white",
        en_analisis: "border-transparent bg-blue-400 text-white",
        enviada: "border-transparent bg-brand-gold text-white",
        archivada: "border-transparent bg-gray-400 text-white",
        aprobado: "border-transparent bg-green-600 text-white",
        borrador: "border-transparent bg-gray-500 text-white",
        revision: "border-transparent bg-yellow-500 text-white",
        publicado: "border-transparent bg-brand-navy text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
