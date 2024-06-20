// full-text-filter.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'fullTextFilter'
})
export class FullTextFilterPipe implements PipeTransform {
  transform(items: any[], searchText: string): any[] {
    if (!items) {
      return [];
    }
    if (!searchText) {
      return items;
    }
    searchText = searchText.toLowerCase();

    return items.filter(item => {
      // Check if the searchText exists in any attribute of the item
      return Object.values(item).some(value =>
        value && value.toString().toLowerCase().includes(searchText)
      );
    });
  }
}
