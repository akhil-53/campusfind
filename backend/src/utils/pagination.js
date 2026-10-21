export function getPaginationParams(req, defaultPageSize = 10, maxPageSize = 50) {
  let page = parseInt(req.query.page, 10);
  let pageSize = parseInt(req.query.pageSize, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  if (pageSize > maxPageSize) pageSize = maxPageSize;

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  return { page, pageSize, skip, take };
}

export function formatPaginatedResponse(data, total, page, pageSize) {
  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1
  };
}
