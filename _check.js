      const API_BASE_URL = "https://script.google.com/macros/s/AKfycbxr1Nlueyw4xddx2t_83RX1WSPoA9I94TFTvBC8kP8bxfzd7kszQmaDPQ5T9FYit2No/exec";
      function buildApiUrl(query) {
        const separator = API_BASE_URL.includes('?') ? '&' : '?';
        return `${API_BASE_URL}${separator}${query}`;
      }
      let materialsData = [];
      let filteredCategory = "all";
      let searchTerm = "";
      let selectedFiles = [];
      let currentRole =
        (localStorage.getItem("qs_role") || "estudiante").toLowerCase() ===
        "docente"
          ? "teacher"
          : "student";

      const elements = {
        teacherBtn: document.getElementById("teacherBtn"),
        studentBtn: document.getElementById("studentBtn"),
        teacherView: document.getElementById("teacherView"),
        studentView: document.getElementById("studentView"),
        uploadArea: document.querySelector(".upload-area"),
        uploadForm: document.getElementById("uploadForm"),
        materialForm: document.getElementById("materialForm"),
        fileInput: document.getElementById("fileInput"),
        progressBar: document.getElementById("progressBar"),
        progressFill: document.getElementById("progressFill"),
        categorySelect: document.getElementById("materialCategory"),
        searchInput: document.getElementById("searchInput"),
        categoryTabs: document.getElementById("categoryTabs"),
        materialsGrid: document.getElementById("materialsGrid"),
        emptyState: document.getElementById("emptyState"),
        emptyMessage: document.getElementById("emptyMessage"),
        statTotal: document.getElementById("statTotalMaterials"),
        statDownloads: document.getElementById("statTotalDownloads"),
        statCategories: document.getElementById("statTotalCategories"),
        statUpdated: document.getElementById("statLastUpdated"),
        notification: document.getElementById("notification"),
        notificationIcon: document.getElementById("notificationIcon"),
        notificationTitle: document.getElementById("notificationTitle"),
        notificationMessage: document.getElementById("notificationMessage"),
      };

      initializeMaterials();

      async function initializeMaterials() {
        wireUploadEvents();
        wireFilters();
        switchRole(currentRole, { silent: true });
        await loadMaterials();
      }

      async function loadMaterials() {
        showEmptyState("Cargando materiales...", true);
        try {
          const response = await fetch(buildApiUrl('action=list'), {
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error(`Error ${response.status}`);
          }
          const payload = await response.json();
          if (payload?.success === false) {
            throw new Error(
              payload.message || "Servicio de materiales no disponible"
            );
          }
          const materials = Array.isArray(payload?.materials)
            ? payload.materials
            : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload)
            ? payload
            : [];
          materialsData = materials.map(normalizeMaterial);
          if (!materialsData.length) {
            showEmptyState("Aun no hay materiales disponibles.");
          } else {
            hideEmptyState();
          }
          renderAll();
        } catch (error) {
          console.error("Error loading materials", error);
          showEmptyState("No se pudieron cargar los materiales.");
          showNotification(
            "error",
            "Error al cargar",
            error.message || "Intenta nuevamente mas tarde"
          );
        }
      }

      function normalizeMaterial(material) {
        if (!material || typeof material !== "object") return {};
        return {
          id:
            material.id ??
            material._id ??
            (typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`),
          title: material.title ?? material.name ?? "Material sin título",
          description: material.description ?? material.summary ?? "",
          category: (material.category ?? material.type ?? "otros")
            .toString()
            .toLowerCase(),
          createdAt:
            material.createdAt ?? material.created_at ?? material.date ?? null,
          updatedAt: material.updatedAt ?? material.updated_at ?? null,
          downloads: Number(material.downloads ?? material.totalDownloads ?? 0),
          extension: (material.extension ?? material.fileExtension ?? "")
            .toString()
            .toLowerCase(),
          mimeType: material.mimeType ?? material.contentType ?? "",
          downloadUrl: material.downloadUrl ?? material.url ?? null,
          size: Number(material.size ?? 0),
        };
      }

      function wireUploadEvents() {
        elements.fileInput?.addEventListener("change", (event) => {
          selectedFiles = Array.from(event.target.files || []);
          if (selectedFiles.length) {
            elements.uploadForm.classList.remove("hidden");
            elements.uploadArea.style.display = "none";
          }
        });

        if (!elements.uploadArea) return;

        ["dragover", "dragenter"].forEach((evt) => {
          elements.uploadArea.addEventListener(evt, (event) => {
            event.preventDefault();
            elements.uploadArea.classList.add("dragover");
          });
        });

        ["dragleave", "dragend"].forEach((evt) => {
          elements.uploadArea.addEventListener(evt, (event) => {
            event.preventDefault();
            elements.uploadArea.classList.remove("dragover");
          });
        });

        elements.uploadArea.addEventListener("drop", (event) => {
          event.preventDefault();
          elements.uploadArea.classList.remove("dragover");
          selectedFiles = Array.from(event.dataTransfer?.files || []);
          if (selectedFiles.length) {
            elements.uploadForm.classList.remove("hidden");
            elements.uploadArea.style.display = "none";
          }
        });

        elements.materialForm?.addEventListener("submit", handleMaterialSubmit);
      }

      function wireFilters() {
        elements.searchInput?.addEventListener("input", (event) => {
          searchTerm = event.target.value.trim().toLowerCase();
          renderMaterials();
        });

        elements.materialsGrid?.addEventListener("click", (event) => {
          const actionButton = event.target.closest("[data-action]");
          if (!actionButton) return;
          const materialId = actionButton.dataset.id;
          if (!materialId) return;
          const action = actionButton.dataset.action;
          if (action === "download") {
            downloadMaterial(materialId);
          } else if (action === "edit") {
            editMaterial(materialId);
          } else if (action === "delete") {
            deleteMaterial(materialId);
          }
        });
      }

      function renderAll() {
        renderCategoryTabs();
        renderMaterials();
        renderStats();
      }

      function renderCategoryTabs() {
        if (!elements.categoryTabs) return;
        const categories = Array.from(
          new Set(materialsData.map((m) => m.category))
        ).filter(Boolean);
        const allCategories = [
          { key: "all", label: "Todos" },
          ...categories.map((key) => ({
            key,
            label: formatCategoryLabel(key),
          })),
        ];

        if (!allCategories.some((cat) => cat.key === filteredCategory)) {
          filteredCategory = "all";
        }

        elements.categoryTabs.innerHTML = allCategories
          .map(
            (category) => `
              <div class="category-tab${
                filteredCategory === category.key ? " active" : ""
              }" data-category="${category.key}">
                ${category.label}
              </div>
            `
          )
          .join("");

        const existingOptions = new Set(
          Array.from(elements.categorySelect?.options || []).map(
            (opt) => opt.value
          )
        );
        categories.forEach((key) => {
          if (elements.categorySelect && !existingOptions.has(key)) {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = formatCategoryLabel(key);
            elements.categorySelect.appendChild(option);
          }
        });

        elements.categoryTabs
          .querySelectorAll(".category-tab")
          .forEach((tab) => {
            tab.addEventListener("click", () => {
              filteredCategory = tab.dataset.category || "all";
              renderMaterials();
            });
          });
      }

      function renderMaterials() {
        if (!elements.materialsGrid) return;
        const matches = materialsData
          .filter((material) => {
            const inCategory =
              filteredCategory === "all" ||
              material.category === filteredCategory;
            if (!searchTerm) return inCategory;
            return (
              inCategory &&
              `${material.title} ${material.description}`
                .toLowerCase()
                .includes(searchTerm)
            );
          })
          .sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt || 0) -
              new Date(a.updatedAt || a.createdAt || 0)
          );

        if (!matches.length) {
          elements.materialsGrid.innerHTML = "";
          showEmptyState("No se encontraron materiales para esta vista.");
          applyRoleVisibility();
          return;
        }

        hideEmptyState();
        const formatter = new Intl.NumberFormat("es-MX");
        elements.materialsGrid.innerHTML = matches
          .map((material) => {
            const fileInfo = getFileInfo(material);
            const downloadsLabel = formatDownloads(
              material.downloads,
              formatter
            );
            const createdLabel = formatDate(
              material.updatedAt || material.createdAt
            );
            const description = material.description
              ? escapeHtml(material.description)
              : "Sin descripción disponible.";

            return `
              <div class="material-card" data-category="${escapeAttr(
                material.category
              )}">
                <div class="material-header">
                  <div class="file-icon ${fileInfo.className}">${
              fileInfo.label
            }</div>
                  <div>
                    <div class="material-title">${escapeHtml(
                      material.title
                    )}</div>
                    <div class="material-meta">
                      <span>${createdLabel}</span>
                      <span>${downloadsLabel}</span>
                    </div>
                  </div>
                </div>
                <div class="material-description">${description}</div>
                <div class="material-actions">
                  <button class="action-btn download-btn" data-action="download" data-id="${
                    material.id
                  }">⬇️ Descargar</button>
                  <button class="action-btn edit-btn teacher-only" data-action="edit" data-id="${
                    material.id
                  }">✏️ Editar</button>
                  <button class="action-btn delete-btn teacher-only" data-action="delete" data-id="${
                    material.id
                  }">🗑️ Eliminar</button>
                </div>
              </div>
            `;
          })
          .join("");

        applyRoleVisibility();
      }

      function renderStats() {
        const formatter = new Intl.NumberFormat("es-MX");
        const total = materialsData.length;
        const downloads = materialsData.reduce(
          (sum, material) => sum + (Number(material.downloads) || 0),
          0
        );
        const categories = new Set(
          materialsData.map((material) => material.category)
        ).size;
        const latestUpdate = materialsData
          .map((material) => material.updatedAt || material.createdAt)
          .filter(Boolean)
          .map((value) => new Date(value))
          .filter((date) => !Number.isNaN(date.getTime()))
          .sort((a, b) => b - a)[0];

        if (elements.statTotal)
          elements.statTotal.textContent = formatter.format(total);
        if (elements.statDownloads)
          elements.statDownloads.textContent = formatter.format(downloads);
        if (elements.statCategories)
          elements.statCategories.textContent = formatter.format(categories);
        if (elements.statUpdated) {
          elements.statUpdated.textContent = latestUpdate
            ? new Intl.DateTimeFormat("es-MX", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(latestUpdate)
            : "Sin registros";
        }
      async function handleMaterialSubmit(event) {
        event.preventDefault();
        if (!selectedFiles.length) {
          showNotification(
            "error",
            "Selecciona un archivo",
            "Debes elegir al menos un archivo para subir"
          );
          return;
        }

        const title = document.getElementById("materialTitle").value.trim();
        const category = elements.categorySelect?.value || "otros";
        const description = document
          .getElementById("materialDescription")
          .value.trim();

        if (!title) {
          showNotification(
            "error",
            "Título requerido",
            "Ingresa el nombre del material antes de subirlo"
          );
          return;
        }

        const formData = new FormData();
        selectedFiles.forEach((file) => formData.append("files", file));
        formData.append("title", title);
        formData.append("category", category);
        formData.append("description", description);
        formData.append("action", "upload");

        try {
          showNotification(
            "info",
            "Subiendo material",
            "Estamos procesando tu archivo"
          );
          const createdMaterial = await uploadMaterial(formData);
          if (createdMaterial) {
            materialsData = [
              normalizeMaterial(createdMaterial),
              ...materialsData,
            ];
            renderAll();
            resetUploadWorkflow();
            showNotification(
              "success",
              "Material subido",
              "El material se cargó correctamente"
            );
          }
        } catch (error) {
          console.error("Upload error", error);
          showNotification(
            "error",
            "No se pudo subir",
            error.message || "Intenta nuevamente"
          );
        }
      function uploadMaterial(formData) {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", buildApiUrl('action=upload'));

          xhr.upload.addEventListener("progress", (event) => {
            if (!event.lengthComputable) return;
            const percentage = Math.round((event.loaded / event.total) * 100);
            elements.progressBar?.classList.remove("hidden");
            if (elements.progressFill) {
              elements.progressFill.style.width = `${percentage}%`;
            }
          });

          xhr.onload = () => {
            elements.progressBar?.classList.add("hidden");
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = xhr.responseText
                  ? JSON.parse(xhr.responseText)
                  : {};
                if (response?.success === false) {
                  reject(new Error(response.message || "No se pudo guardar"));
                  return;
                }
                resolve(response.material ?? response);
              } catch (parseError) {
                resolve({});
              }
            } else {
              reject(new Error(xhr.responseText || `Error ${xhr.status}`));
            }
          };

          xhr.onerror = () => {
            elements.progressBar?.classList.add("hidden");
            reject(new Error("Error de red durante la carga"));
          };

          xhr.send(formData);
        });
      }

      function resetUploadWorkflow() {
        selectedFiles = [];
        if (elements.fileInput) elements.fileInput.value = "";
        if (elements.materialForm) elements.materialForm.reset();
        if (elements.progressFill) elements.progressFill.style.width = "0%";
        if (elements.uploadForm) elements.uploadForm.classList.add("hidden");
        if (elements.uploadArea) {
          elements.uploadArea.style.display = "";
          elements.uploadArea.classList.remove("dragover");
        }
      function cancelUpload() {
        resetUploadWorkflow();
      }

      async function downloadMaterial(id) {
        const material = materialsData.find((item) => String(item.id) === String(id));
        if (!material) {
          showNotification(
            "error",
            "Material no encontrado",
            "El recurso seleccionado no está disponible"
          );
          return;
        }
        try {
          const response = await fetch(
            buildApiUrl(`action=download&id=${encodeURIComponent(material.id)}`),
            {
              headers: { Accept: "application/json" },
              cache: "no-store",
            }
          );
          if (!response.ok) {
            throw new Error(`Error ${response.status}`);
          }
          const payload = await response.json();
          if (payload?.success === false) {
            throw new Error(
              payload.message || "Servicio de materiales no disponible"
            );
          }
          const targetUrl =
            payload.downloadUrl ||
            material.downloadUrl ||
            buildApiUrl(`action=download&id=${encodeURIComponent(material.id)}`);
          if (payload.downloads !== undefined) {
            material.downloads = Number(payload.downloads) || 0;
          } else if (!Number.isNaN(Number(material.downloads))) {
            material.downloads = Number(material.downloads || 0) + 1;
          }
          renderStats();
          window.open(targetUrl, "_blank", "noopener");
          showNotification("success", "Descarga iniciada", material.title);
        } catch (error) {
          showNotification(
            "error",
            "No se pudo descargar",
            error.message || "Intenta nuevamente"
          );
        }
      }

      async function editMaterial(id) {
        if (currentRole !== "teacher") return;
        const material = materialsData.find((item) => String(item.id) === String(id));
        if (!material) return;
        const newTitle = prompt("Editar título", material.title);
        if (newTitle === null) return;
        const newDescription = prompt(
          "Editar descripción",
          material.description || ""
        );
        if (newDescription === null) return;
        try {
          const response = await fetch(
            buildApiUrl(`action=update&id=${encodeURIComponent(material.id)}`),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: newTitle.trim(),
                description: newDescription.trim(),
              }),
            }
          );
          if (!response.ok) {
            throw new Error(`Error ${response.status}`);
          }
          const payload = await response.json();
          if (payload?.success === false) {
            throw new Error(payload.message || "No se pudo actualizar");
          }
          const updated = normalizeMaterial(payload.material ?? payload);
          materialsData = materialsData.map((item) =>
            String(item.id) === String(updated.id) ? updated : item
          );
          renderAll();
          showNotification(
            "success",
            "Material actualizado",
            "Los cambios se guardaron correctamente"
          );
        } catch (error) {
          console.error("Edit error", error);
          showNotification(
            "error",
            "No se pudo actualizar",
            error.message || "Revisa e intenta de nuevo"
          );
        }
      }

      async function deleteMaterial(id) {
        if (currentRole !== "teacher") return;
        const material = materialsData.find((item) => String(item.id) === String(id));
        if (!material) return;
        const confirmed = confirm(
          `¿Estás seguro de eliminar "${material.title}"?`
        );
        if (!confirmed) return;
        try {
          const response = await fetch(
            buildApiUrl(`action=delete&id=${encodeURIComponent(material.id)}`),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            }
          );
          const raw = await response.text();
          let payload = {};
          if (raw) {
            try {
              payload = JSON.parse(raw);
            } catch (parseError) {
              payload = {};
            }
          }
          if (!response.ok || payload?.success === false) {
            throw new Error(
              (payload && payload.message) || `Error ${response.status}`
            );
          }
          materialsData = materialsData.filter(
            (item) => String(item.id) !== String(material.id)
          );
          renderAll();
          showNotification(
            "success",
            "Material eliminado",
            "El recurso se eliminó correctamente"
          );
        } catch (error) {
          console.error("Delete error", error);
          showNotification(
            "error",
            "No se pudo eliminar",
            error.message || "Intenta nuevamente"
          );
        }
      }

      function switchRole(role, options = {}) {
        if (role !== "teacher" && role !== "student") return;
        currentRole = role;
        elements.teacherBtn?.classList.toggle("active", role === "teacher");
        elements.studentBtn?.classList.toggle("active", role === "student");
        elements.teacherView?.classList.toggle("hidden", role !== "teacher");
        elements.studentView?.classList.toggle("hidden", role !== "student");
        applyRoleVisibility();
        try {
          localStorage.setItem(
            "qs_role",
            role === "teacher" ? "docente" : "estudiante"
          );
        } catch (error) {}
        if (!options.silent) {
          showNotification(
            "success",
            "Vista cambiada",
            `Ahora ves como ${role === "teacher" ? "Profesor" : "Estudiante"}`
          );
        }
      }

      function applyRoleVisibility() {
        document.querySelectorAll(".teacher-only").forEach((element) => {
          element.classList.toggle("hidden", currentRole !== "teacher");
        });
      }

      function showEmptyState(message, loading = false) {
        if (!elements.emptyState || !elements.emptyMessage) return;
        elements.emptyMessage.textContent = message;
        elements.emptyState.classList.remove("hidden");
        elements.emptyState.classList.toggle("loading", loading);
      }

      function hideEmptyState() {
        elements.emptyState?.classList.add("hidden");
      }

      function showNotification(type, title, message) {
        if (!elements.notification) return;
        const icons = { success: "✅", error: "⚠️", info: "ℹ️" };
        elements.notificationIcon.textContent = icons[type] || "ℹ️";
        elements.notificationTitle.textContent = title;
        elements.notificationMessage.textContent = message;
        elements.notification.classList.toggle("error", type === "error");
        elements.notification.classList.add("show");
        setTimeout(() => {
          elements.notification?.classList.remove("show");
        }, 3000);
      }

      function formatCategoryLabel(key = "otros") {
        return key
          .toString()
          .replace(/[_-]+/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
      }

      function getFileInfo(material) {
        const extension = (material.extension || "").toLowerCase();
        const map = {
          pdf: "pdf",
          doc: "doc",
          docx: "doc",
          xls: "xls",
          xlsx: "xls",
          ppt: "ppt",
          pptx: "ppt",
        };
        const className = map[extension] || "default";
        const label = extension ? extension.toUpperCase() : "FILE";
        return { className, label };
      }

      function formatDownloads(value, formatter) {
        const count = Number(value) || 0;
        const formatted = formatter.format(count);
        return `${formatted} descarga${count === 1 ? "" : "s"}`;
      }

      function formatDate(value) {
        if (!value) return "Sin fecha";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
          date
        );
      }

      function escapeHtml(value) {
        return value.replace(
          /[&<>"']/g,
          (char) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            }[char])
        );
      }

      function escapeAttr(value) {
        return escapeHtml(value).replace(/\s+/g, "-");
      }

      window.switchRole = switchRole;
      window.cancelUpload = cancelUpload;
    