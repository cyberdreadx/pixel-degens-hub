const Index = () => {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      {/* Coming Soon Overlay */}
      <div className="absolute inset-x-0 bottom-0 top-0 z-50 flex items-center justify-center backdrop-blur-sm bg-background/60">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold neon-glow">COMING SOON</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            THIS PAGE IS UNDER CONSTRUCTION
          </p>
        </div>
      </div>
      
      {/* Preview Content (blurred underneath) */}
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">Welcome to Your Blank App</h1>
        <p className="text-xl text-muted-foreground">Start building your amazing project here!</p>
      </div>
    </div>
  );
};

export default Index;
