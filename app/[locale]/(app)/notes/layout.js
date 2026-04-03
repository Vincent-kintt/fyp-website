export default function NotesLayout({ children }) {
  return (
    <>
      <style>{`
        #main-content ~ footer { display: none; }
        body { overflow: hidden; }
      `}</style>
      <div className="h-[calc(100dvh-4rem)] overflow-hidden">
        {children}
      </div>
    </>
  );
}
