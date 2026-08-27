import NavBar from "@/components/NavBar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <NavBar />
      <main className="flex-1 md:h-screen md:overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>
    </div>
  );
}
