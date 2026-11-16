// Unknown /api routes
export const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
};

// Last stop for any error thrown in a route (Express 5 forwards async errors here).
// eslint-disable-next-line no-unused-vars
export const errorHandler = (error, req, res, next) => {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            message: "Request body is not valid JSON"
        });
    }

    console.error(`${req.method} ${req.originalUrl} failed:`, error);

    res.status(error.status || 500).json({
        success: false,
        message: error.expose ? error.message : "Something went wrong. Please try again."
    });
};
