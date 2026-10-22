export const ErrorMessage = ({ children }: { children: React.ReactNode }) => {
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  )
}
