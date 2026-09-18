import { describe, expect, it, vi } from 'vitest';
import { LatestTask } from '@/analysis/latestTask';

function deferred<T>() {
  let resolve!:(value:T)=>void;
  let reject!:(error:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
describe('latest-only shadow queue',()=>{
  it('finishes the running frame, drops intermediate slider times, then computes the newest',async()=>{
    const first=deferred<number>(),last=deferred<number>();
    const run=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise);
    const show=vi.fn(),error=vi.fn();
    const queue=new LatestTask<number,number>(run,show,error);
    queue.submit(600);queue.submit(601);queue.submit(602);queue.submit(620);
    expect(run.mock.calls).toEqual([[600]]);
    first.resolve(1);await first.promise;
    expect(show).toHaveBeenCalledWith(1,600);
    expect(run.mock.calls).toEqual([[600],[620]]);
    last.resolve(2);await last.promise;
    expect(show).toHaveBeenLastCalledWith(2,620);
    expect(error).not.toHaveBeenCalled();
  });
  it('does not show results from a disposed scene or start its pending request',async()=>{
    const task=deferred<number>();const run=vi.fn(()=>task.promise),show=vi.fn();
    const queue=new LatestTask<number,number>(run,show,vi.fn());
    queue.submit(1);queue.submit(2);queue.dispose();task.resolve(5);await task.promise;
    queue.submit(3);
    expect(show).not.toHaveBeenCalled();expect(run).toHaveBeenCalledTimes(1);
  });
  it('recovers from a failed frame and continues to the newest request',async()=>{
    const task=deferred<number>(),error=vi.fn(),show=vi.fn();
    const run=vi.fn().mockReturnValueOnce(task.promise).mockResolvedValueOnce(2);
    const queue=new LatestTask<number,number>(run,show,error);
    queue.submit(1);queue.submit(2);task.reject(new Error('frame failed'));
    await Promise.resolve();await Promise.resolve();
    expect(error).toHaveBeenCalledTimes(1);expect(show).toHaveBeenCalledWith(2,2);
  });
});
