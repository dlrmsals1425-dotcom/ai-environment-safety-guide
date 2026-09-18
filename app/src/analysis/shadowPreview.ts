import { bboxSizeMeters, type BBox } from '@/geo/aoi';

/** A finer ray sampling grid, not a claim about source elevation accuracy.
 * Cap work for large user AOIs; a normal 500m AOI + 300m buffer uses 2m cells.
 */
export function shadowPreviewCellSize(bbox: BBox): number {
  const {width,height}=bboxSizeMeters(bbox);
  const maxCells=400_000;
  let cellSize=2;
  while (Math.ceil(width/cellSize)*Math.ceil(height/cellSize)>maxCells) cellSize+=0.5;
  return cellSize;
}
