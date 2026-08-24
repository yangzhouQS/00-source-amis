/**
 * 列表分组工具（移植旧版 innerTransformRequestCategory + sortTopUp 算法）
 */
export interface DsGroup<T> {
  title: string;
  children: T[];
}

/** 置顶项在前，组内按 sort 升序 */
function sortTopUp<T extends { isTopUp?: boolean; sort?: number }>(children: T[]): T[] {
  const topUp: T[] = [];
  const normal: T[] = [];
  for (const child of children) {
    if (child.isTopUp === true) {
      topUp.push(child);
    }
    else {
      normal.push(child);
    }
  }
  const bySort = (a: T, b: T) => (a.sort ?? 1) - (b.sort ?? 1);
  return [...topUp.sort(bySort), ...normal.sort(bySort)];
}

/** 按指定键分组并排序（组名升序） */
export function transformGroups<T extends Record<string, any>>(
  items: T[],
  groupKey = "groupName",
): DsGroup<T>[] {
  if (!items.length) {
    return [];
  }
  const titles = Array.from(new Set(items.map(i => String(i[groupKey] ?? ""))));
  titles.sort();
  return titles.map((title) => {
    const children = items.filter(i => String(i[groupKey] ?? "") === title);
    return { title, children: sortTopUp(children) };
  });
}

/** 关键字过滤（id + description 模糊匹配） */
export function filterByKeyword<T extends { id: string; description?: string }>(
  items: T[],
  keyword: string,
): T[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) {
    return items;
  }
  return items.filter(i => `${i.id}${i.description ?? ""}`.toLowerCase().includes(kw));
}

/** 计算不重复的副本编码（复制服务用）：loadData → loadDataCopy / loadDataCopy2 … */
export function uniqueCopyId(existing: Set<string>, sourceId: string): string {
  let candidate = `${sourceId}Copy`;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `${sourceId}Copy${n}`;
    n += 1;
  }
  return candidate;
}
