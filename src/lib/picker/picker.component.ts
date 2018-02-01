import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';

import categories from '../data/categories';
import { Emoji } from '../emoji/emoji.component';
import * as frequently from '../utils/frequently';
import * as store from '../utils/store';
import { AnchorsComponent } from './anchors.component';
import { CategoryComponent } from './category.component';
import { PreviewComponent } from './preview.component';


const RECENT_CATEGORY = { id: 'recent', name: 'Recent', emojis: null };
const SEARCH_CATEGORY = {
  id: 'search',
  name: 'Search',
  emojis: null,
  anchor: false,
};
const CUSTOM_CATEGORY = { id: 'custom', name: 'Custom', emojis: [] };

const I18N = {
  search: 'Search',
  notfound: 'No Emoji Found',
  categories: {
    search: 'Search Results',
    recent: 'Frequently Used',
    people: 'Smileys & People',
    nature: 'Animals & Nature',
    foods: 'Food & Drink',
    activity: 'Activity',
    places: 'Travel & Places',
    objects: 'Objects',
    symbols: 'Symbols',
    flags: 'Flags',
    custom: 'Custom',
  },
};

@Component({
  selector: 'emoji-mart',
  templateUrl: './picker.component.html',
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  preserveWhitespaces: false,
})
export class PickerComponent implements OnInit, AfterViewInit {
  @Input() perLine = 9;
  @Input() i18n: any = {};
  @Input() style = {};
  @Input() title = 'Emoji Mart™';
  @Input() emoji = 'department_store';
  @Input() color = '#ae65c5';
  @Input() categories: any[] = [];
  @Input() set: Emoji['set'];
  @Input() skin: Emoji['skin'];
  @Input() native: Emoji['native'] = true;
  @Input() emojiSize: Emoji['size'] = 24;
  @Input() sheetSize: Emoji['sheetSize'] = 64;
  @Input() emojisToShowFilter = null;
  @Input() showPreview = true;
  @Input() emojiTooltip = false;
  @Input() autoFocus = false;
  @Input() custom: any[] = [];
  @Input() hideRecent = true;
  @Input() include: string[] = [];
  @Input() exclude: string[] = [];
  @Output() click = new EventEmitter<any>();
  @ViewChild('scrollRef') private scrollRef: ElementRef;
  @ViewChild('anchorsRef') private anchorsRef: AnchorsComponent;
  @ViewChild('previewRef') private previewRef: PreviewComponent;
  @ViewChildren('categoryRef') private categoryRefs: QueryList<CategoryComponent>;
  scrollHeight: number;
  clientHeight: number;
  selected: string;
  scrollTop: number;
  firstRender = true;
  RECENT_CATEGORY = RECENT_CATEGORY;
  CUSTOM_CATEGORY = CUSTOM_CATEGORY;
  recent: string[];
  previewEmoji: any;
  leaveTimeout: any;
  @Input() backgroundImageFn: Emoji['backgroundImageFn'] = (set: string, sheetSize: number) =>
    `https://unpkg.com/emoji-datasource-${this.set}@4.0.3/img/${
      this.set
    }/sheets-256/${this.sheetSize}.png`

  constructor(private ref: ChangeDetectorRef) { }

  ngOnInit() {
    this.i18n = { ...I18N, ...this.i18n };
    this.i18n.categories = { ...I18N.categories, ...this.i18n.categories };
    this.skin = store.get('skin') || this.skin;

    const allCategories = [].concat(categories);

    if (this.custom.length > 0) {
      CUSTOM_CATEGORY.emojis = this.custom.map(emoji => {
        return {
          ...emoji,
          // `<Category />` expects emoji to have an `id`.
          id: emoji.short_names[0],
          custom: true,
        };
      });

      allCategories.push(CUSTOM_CATEGORY);
    }

    if (this.include !== undefined) {
      allCategories.sort((a, b) => {
        if (this.include.indexOf(a.id) > this.include.indexOf(b.id)) {
          return 1;
        }

        return 0;
      });
    }

    for (
      let categoryIndex = 0;
      categoryIndex < allCategories.length;
      categoryIndex++
    ) {
      const category = allCategories[categoryIndex];
      const isIncluded =
        this.include && this.include.length
          ? this.include.indexOf(category.id) > -1
          : true;
      const isExcluded =
        this.exclude && this.exclude.length
          ? this.exclude.indexOf(category.id) > -1
          : false;
      if (!isIncluded || isExcluded) {
        continue;
      }

      if (this.emojisToShowFilter) {
        const newEmojis = [];

        const { emojis } = category;
        for (let emojiIndex = 0; emojiIndex < emojis.length; emojiIndex++) {
          const emoji = emojis[emojiIndex];
          if (this.emojisToShowFilter(emojis[emoji] || emoji)) {
            newEmojis.push(emoji);
          }
        }

        if (newEmojis.length) {
          const newCategory = {
            emojis: newEmojis,
            name: category.name,
            id: category.id,
          };

          this.categories.push(newCategory);
        }
      } else {
        this.categories.push(category);
      }
    }

    const includeRecent =
      this.include && this.include.length
        ? this.include.indexOf(RECENT_CATEGORY.id) > -1
        : true;
    const excludeRecent =
      this.exclude && this.exclude.length
        ? this.exclude.indexOf(RECENT_CATEGORY.id) > -1
        : false;
    if (includeRecent && !excludeRecent) {
      this.hideRecent = false;
      this.categories.unshift(RECENT_CATEGORY);
    }

    if (this.categories[0]) {
      this.categories[0].first = true;
    }

    this.categories.unshift(SEARCH_CATEGORY);
    this.selected = this.categories.filter(category => category.first)[0].name;
  }

  ngAfterViewInit() {
    this.updateCategoriesSize();
  }

  updateCategoriesSize() {
    for (let i = 0, l = this.categories.length; i < l; i++) {
      const component = this.categoryRefs[`category-${i}`];
      if (component) {
        component.memoizeSize();
      }
    }

    if (this.scrollRef) {
      const target = this.scrollRef.nativeElement;
      this.scrollHeight = target.scrollHeight;
      this.clientHeight = target.clientHeight;
    }
  }

  handleAnchorClick($event) {
    const component = this.categoryRefs.find((n) => n.id === $event.category.id);
    let scrollToComponent = null;

    scrollToComponent = () => {
      if (component) {
        let { top } = component;

        if ($event.category.first) {
          top = 0;
        } else {
          top += 1;
        }
        this.scrollRef.nativeElement.scrollTop = top;
      }
    };

    if (SEARCH_CATEGORY.emojis) {
      // this.handleSearch(null);
      // this.search.clear();

      window.requestAnimationFrame(scrollToComponent);
    } else {
      scrollToComponent();
    }
  }
  categoryTrack(index, item) {
    return item.id;
  }
  handleScroll() {
    if (!this.scrollRef) {
      return;
    }

    let activeCategory = null;
    let scrollTop;

    if (SEARCH_CATEGORY.emojis) {
      activeCategory = SEARCH_CATEGORY;
    } else {
      const target = this.scrollRef.nativeElement;
      scrollTop = target.scrollTop;
      const scrollingDown = scrollTop > (this.scrollTop || 0);
      let minTop = 0;

      for (let i = 0, l = this.categories.length; i < l; i++) {
        const ii = scrollingDown ? this.categories.length - 1 - i : i;
        const category = this.categories[ii];
        const component = this.categoryRefs.find((n) => n.id === category.id);

        if (component) {
          const active = component.handleScroll(scrollTop);

          if (!minTop || component.top < minTop) {
            if (component.top > 0) {
              minTop = component.top;
            }
          }

          if (active && !activeCategory) {
            activeCategory = category;
          }
        }
      }

      if (scrollTop < minTop) {
        activeCategory = this.categories.filter(category => !(category.anchor === false))[0];
      } else if (scrollTop + this.clientHeight >= this.scrollHeight) {
        activeCategory = this.categories[this.categories.length - 1];
      }
    }

    if (activeCategory) {
      const { name: categoryName } = activeCategory;

      if (this.selected !== categoryName) {
        this.selected = categoryName;
      }
    }

    this.scrollTop = scrollTop;
  }
  handleSearch($emojis: any) {
    SEARCH_CATEGORY.emojis = $emojis;
    for (const component of this.categoryRefs.toArray()) {
      if (component.name === 'Search') {
        component.emojis = $emojis;
        component.updateDisplay($emojis ? 'inherit' : 'none');
      } else {
        component.updateDisplay($emojis ? 'none' : 'inherit');
      }
    }

    // this.forceUpdate();
    this.scrollRef.nativeElement.scrollTop = 0;
    this.handleScroll();
  }

  handleEmojiOver($event) {
    if (!this.previewRef) {
      return;
    }

    const emojiData = CUSTOM_CATEGORY.emojis.find(customEmoji => customEmoji.id === $event.emoji.id);
    if (emojiData) {
      for (const key of Object.keys(emojiData)) {
        if (emojiData.hasOwnProperty(key)) {
          $event.emoji[key] = emojiData[key];
        }
      }
    }

    this.previewEmoji = $event.emoji;
    clearTimeout(this.leaveTimeout);
  }

  handleEmojiLeave($event) {
    if (!this.previewRef) {
      return;
    }

    this.leaveTimeout = setTimeout(() => {
      this.previewEmoji = null;
      this.ref.markForCheck();
    }, 16);
  }

  handleEmojiClick($event) {
    this.click.emit($event);
    if (!this.hideRecent && !this.recent) {
      console.log($event.emoji);
      frequently.add($event.emoji);
    }

    const component = this.categoryRefs.toArray()[1];
    if (component) {
      const maxMargin = component.maxMargin;
      component.emojis = frequently.get(maxMargin);
      component.ref.markForCheck();

      window.requestAnimationFrame(() => {
        if (!this.scrollRef) {
          return;
        }
        component.memoizeSize();
        if (maxMargin === component.maxMargin) {
          return;
        }

        this.updateCategoriesSize();
        this.handleScroll();

        if (SEARCH_CATEGORY.emojis) {
          component.updateDisplay('none');
        }
      });
    }
  }
}