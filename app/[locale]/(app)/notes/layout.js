export default function NotesLayout({ children }) {
  return (
    <>
      <style>{`
        #main-content ~ footer { display: none; }
        body { overflow: hidden; }
      `}</style>
      <div
        className="h-[calc(100dvh-4rem)] overflow-hidden"
        style={{
          /* Break out of parent (app) layout container constraints */
          width: "100vw",
          maxWidth: "100vw",
          marginLeft: "calc(-50vw + 50%)",
          marginTop: "-2rem",
          paddingTop: 0,
        }}
      >
        {children}
      </div>
    </>
  );
}
