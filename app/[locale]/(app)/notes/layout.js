export default function NotesLayout({ children }) {
  return (
    <div className="notes-page h-[calc(100dvh-4rem-60px-env(safe-area-inset-bottom,0px))] md:h-[calc(100dvh-4rem)] overflow-hidden">
      {children}
    </div>
  );
}
