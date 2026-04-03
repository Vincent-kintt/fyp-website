export default function NotesLayout({ children }) {
  return (
    <div className="notes-page h-[calc(100dvh-4rem)] overflow-hidden">
      {children}
    </div>
  );
}
