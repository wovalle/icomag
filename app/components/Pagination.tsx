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
  // Calculate pagination links - simplified for mobile
  const getVisiblePages = () => {
    // On smaller screens, show fewer page links
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const visiblePageCount = isMobile ? 3 : 5;

    let paginationLinks = [];

    // Always show first page
    paginationLinks.push(1);

    if (pageCount <= 1) {
      return paginationLinks; // Only show page 1
    }

    // Calculate the range of pages to show
    let startPage = Math.max(2, currentPage - Math.floor(visiblePageCount / 2));
    let endPage = Math.min(pageCount - 1, startPage + visiblePageCount - 2);

    // Adjust the start if we're near the end
    startPage = Math.max(
      2,
      Math.min(startPage, pageCount - visiblePageCount + 1)
    );

    // Add ellipsis if needed after page 1
    if (startPage > 2) {
      paginationLinks.push("...");
    }

    // Add the pages in the middle
    for (let i = startPage; i <= endPage; i++) {
      paginationLinks.push(i);
    }

    // Add ellipsis if needed before the last page
    if (endPage < pageCount - 1) {
      paginationLinks.push("...");
    }

    // Always show last page if there's more than one page
    if (pageCount > 1) {
      paginationLinks.push(pageCount);
    }

    return paginationLinks;
  };

  return (
    <div className="flex flex-col items-center my-4">
      <div className="join mb-3">
        <button
          className="join-item btn btn-sm sm:btn-md"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          «
        </button>

        {getVisiblePages().map((link, index) =>
          typeof link === "number" ? (
            <button
              key={index}
              className={`join-item btn btn-sm sm:btn-md ${
                currentPage === link ? "btn-primary" : ""
              }`}
              onClick={() => onPageChange(link)}
            >
              {link}
            </button>
          ) : (
            <button
              key={index}
              className="join-item btn btn-sm sm:btn-md btn-disabled"
            >
              {link}
            </button>
          )
        )}

        <button
          className="join-item btn btn-sm sm:btn-md"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
        >
          »
        </button>
      </div>

      {/* Pagination info */}
      <div className="text-center text-xs sm:text-sm text-base-content/60 pb-4">
        Showing {Math.min((currentPage - 1) * limit + 1, totalCount)} -{" "}
        {Math.min(currentPage * limit, totalCount)} of {totalCount} transactions
      </div>
    </div>
  );
}
