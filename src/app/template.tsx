export default function Template({ children }: { children: React.ReactNode }) {
  // Re-mounts on every route change so each page glides in.
  return <div className="animate-rise">{children}</div>;
}
