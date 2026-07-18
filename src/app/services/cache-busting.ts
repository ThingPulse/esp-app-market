import { HttpParams } from '@angular/common/http';

let requestSequence = 0;

export function cacheBustingParams(): HttpParams {
  requestSequence += 1;

  return new HttpParams().set('version', `${Date.now()}-${requestSequence}`);
}
