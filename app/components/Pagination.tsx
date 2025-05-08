interface PaginationProps {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalCount: number;
  limit: number;
}

export default function Pagination({
  currentPage,
  pageCount,
  onPageChange,
  totalCount,
  limit,
}: PaginationProps) {
  // Calculate pagination links
  const paginationLinks = [];
  for (let i = 1; i <= pageCount; i++) {
    if (
      i === 1 ||
      i === pageCount ||
      (i >= currentPage - 2 && i <= currentPage + 2)
    ) {
      paginationLinks.push(i);
    } else if (
      (i === currentPage - 3 && i > 1) ||
      (i === currentPage + 3 && i < pageCount)
    ) {
      paginationLinks.push("...");
    }
  }

  return (
    <>
      {pageCount > 1 && (
        <div className="flex justify-center my-4">
          <div className="join">
            <button
              className="join-item btn"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              «
            </button>

            {paginationLinks.map((link, index) =>
              typeof link === "number" ? (
                <button
                  key={index}
                  className={`join-item btn ${
                    currentPage === link ? "btn-primary" : ""
                  }`}
                  onClick={() => onPageChange(link)}
                >
                  {link}
                </button>
              ) : (
                <button key={index} className="join-item btn btn-disabled">
                  {link}
                </button>
              )
            )}

            <button
              className="join-item btn"
              disabled={currentPage >= pageCount}
              onClick={() => onPageChange(currentPage + 1)}
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* Pagination info */}
      <div className="text-center text-sm text-gray-600 pb-4">
        Showing {Math.min((currentPage - 1) * limit + 1, totalCount)} -{" "}
        {Math.min(currentPage * limit, totalCount)} of {totalCount} transactions
      </div>
    </>
  );
}
