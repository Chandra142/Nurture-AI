// Mobile Menu Toggle
      const mobileMenuToggle = document.getElementById("mobileMenuToggle");
      const mobileMenu = document.getElementById("mobileMenu");
      mobileMenuToggle.addEventListener("click", () => {
        mobileMenu.classList.toggle("hidden");
        const icon = mobileMenuToggle.querySelector("i");
        if (icon.classList.contains("fa-bars")) {
          icon.classList.remove("fa-bars");
          icon.classList.add("fa-xmark");
        } else {
          icon.classList.remove("fa-xmark");
          icon.classList.add("fa-bars");
        }
      });

      // Smooth scrolling for anchor links
      document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", function(e) {
          e.preventDefault();
          document.querySelector(this.getAttribute("href")).scrollIntoView({
            behavior: "smooth"
          });
        });
      });

      // Newsletter form submission
      document.querySelector("form").addEventListener("submit", (e) => {
        e.preventDefault();
        const email = e.target.querySelector("input").value;
        if (email) {
          alert(`Thanks for joining! We've sent a confirmation to ${email}`);
          e.target.querySelector("input").value = "";
        }
      });
