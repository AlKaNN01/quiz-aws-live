import React from "react";
import { Toast } from "./Toast";

/**
 * Error Boundary for catching React component errors
 * Prevents entire app from crashing on component error
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showToast: false,
      toastMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);

    this.setState((prevState) => ({
      error,
      errorInfo,
      showToast: true,
      toastMessage: `Hata: ${error.message || "Bilinmeyen hata oluştu"}`,
    }));

    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error Details:", error);
      console.error("Error Info:", errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showToast: false,
      toastMessage: "",
    });
  };

  closeToast = () => {
    this.setState({ showToast: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "100vh",
              backgroundColor: "#f5f5f5",
              padding: "20px",
              fontFamily: "Arial, sans-serif",
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "8px",
                padding: "40px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                maxWidth: "600px",
                textAlign: "center",
              }}
            >
              <h2 style={{ color: "#d32f2f", marginBottom: "16px" }}>
                ⚠️ Bir Hata Oluştu
              </h2>

              <p
                style={{
                  color: "#666",
                  marginBottom: "24px",
                  fontSize: "16px",
                }}
              >
                Üzgünüz, uygulama sırasında beklenmeyen bir hata oluştu.
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <details style={{ marginBottom: "24px", textAlign: "left" }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      color: "#1976d2",
                      fontWeight: "bold",
                    }}
                  >
                    Hata Detayları (Geliştirme Modu)
                  </summary>
                  <pre
                    style={{
                      backgroundColor: "#f5f5f5",
                      padding: "12px",
                      borderRadius: "4px",
                      overflow: "auto",
                      marginTop: "8px",
                      fontSize: "12px",
                      color: "#d32f2f",
                    }}
                  >
                    {this.state.error.toString()}
                    {this.state.errorInfo &&
                      this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <button
                onClick={this.handleReset}
                style={{
                  backgroundColor: "#1976d2",
                  color: "white",
                  border: "none",
                  padding: "12px 32px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "bold",
                  marginRight: "8px",
                }}
              >
                Sayfayı Yeniden Yükle
              </button>

              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  backgroundColor: "#666",
                  color: "white",
                  border: "none",
                  padding: "12px 32px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "bold",
                }}
              >
                Ana Sayfaya Git
              </button>
            </div>
          </div>

          {this.state.showToast && (
            <Toast
              message={this.state.toastMessage}
              onClose={this.closeToast}
              type="error"
            />
          )}
        </>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
