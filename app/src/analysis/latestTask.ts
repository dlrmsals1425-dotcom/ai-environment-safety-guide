/** One running task plus the latest pending input. Completed frames are labelled
 * with their own time while a newer requested time is being computed. */
export class LatestTask<T, R> {
  private pending: {input:T} | null = null;
  private running = false;
  private disposed = false;
  constructor(private run:(input:T)=>Promise<R>, private result:(output:R,input:T)=>void,
    private error:(error:unknown)=>void) {}
  submit(input:T) {
    if (this.disposed) return;
    this.pending={input};
    void this.pump();
  }
  dispose() { this.disposed=true; this.pending=null; }
  private async pump() {
    if (this.running || this.disposed) return;
    this.running=true;
    try {
      while (this.pending && !this.disposed) {
        const {input}=this.pending;
        this.pending=null;
        try {
          const output=await this.run(input);
          if (!this.disposed) this.result(output,input);
        } catch (error) { if (!this.disposed) this.error(error); }
      }
    } finally { this.running=false; }
  }
}
