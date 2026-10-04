
const queryInput = document.getElementById('search-input');
const countryInput = document.getElementById('location-input');
const resultsContainer = document.getElementById('results');
const typeFilter = document.getElementById('type-filter');
const remoteFilter = document.getElementById('remote-filter');
const dateFilter = document.getElementById('date-filter');
const salaryFilter = document.getElementById('salary-filter');
const clearFiltersButton = document.getElementById('clear-filters');
const experienceFilter = document.getElementById('experience-filter');
const minSalaryInput = document.getElementById('min-salary-input');
const companyInput = document.getElementById('company-input');
const directFilter = document.getElementById('direct-filter');

let query = '';
let country = '';
let jobsCache = [];

const activeFilters = {
    type: 'all',
    remote: 'all',
    date: 'all',
    salary: 'all'
};

// New filters
activeFilters.experience = 'all';
activeFilters.minSalary = '';
activeFilters.company = '';
activeFilters.direct = 'all';

const parseJobDate = (job) => {
    const rawDate = job.job_posted_at_datetime_utc || job.job_posted_at;
    const parsed = rawDate ? Date.parse(rawDate) : NaN;
    return Number.isNaN(parsed) ? null : new Date(parsed);
};

const normalizeTypeValue = (job) => {
    const types = [
        ...(Array.isArray(job.job_employment_types) ? job.job_employment_types : []),
        job.job_employment_type
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/_+/g, '-');

    return types;
};

const filterJobs = (jobs) => {
    return jobs.filter((job) => {
        if (activeFilters.type !== 'all') {
            const normalizedType = normalizeTypeValue(job);
            if (!normalizedType.includes(activeFilters.type)) {
                return false;
            }
        }

        if (activeFilters.remote === 'remote' && !job.job_is_remote) {
            return false;
        }

        if (activeFilters.remote === 'onsite' && job.job_is_remote) {
            return false;
        }

        if (activeFilters.date !== 'all') {
            const postedDate = parseJobDate(job);
            if (!postedDate) {
                return false;
            }

            const ageMs = Date.now() - postedDate.getTime();
            const thresholds = {
                '24h': 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000,
                '30d': 30 * 24 * 60 * 60 * 1000
            };

            if (ageMs > thresholds[activeFilters.date]) {
                return false;
            }
        }

        if (activeFilters.salary !== 'all') {
            const hasSalary = Boolean(
                job.job_salary_string ||
                job.job_min_salary ||
                job.job_max_salary
            );

            if (activeFilters.salary === 'disclosed' && !hasSalary) {
                return false;
            }

            if (activeFilters.salary === 'undisclosed' && hasSalary) {
                return false;
            }
        }

        if (activeFilters.experience !== 'all') {
            const expField = (job.job_experience_level || job.job_experience_levels || '')
                .toString()
                .toLowerCase();
            if (!expField.includes(activeFilters.experience)) {
                return false;
            }
        }

        if (activeFilters.minSalary !== '') {
            const minReq = Number(activeFilters.minSalary);
            if (!Number.isNaN(minReq) && minReq > 0) {
                const jobMin = Number(job.job_min_salary || job.job_salary_min || 0);
                const jobMax = Number(job.job_max_salary || job.job_salary_max || 0);
                const jobValue = jobMin || jobMax || 0;
                if (jobValue === 0 || jobValue < minReq) {
                    return false;
                }
            }
        }

        if (activeFilters.company) {
            const name = (job.employer_name || '').toString().toLowerCase();
            if (!name.includes(activeFilters.company)) {
                return false;
            }
        }

        if (activeFilters.direct === 'direct' && !job.job_apply_is_direct) {
            return false;
        }

        return true;
    });
};

const resetFilters = () => {
    typeFilter.value = 'all';
    remoteFilter.value = 'all';
    dateFilter.value = 'all';
    salaryFilter.value = 'all';

    experienceFilter.value = 'all';
    minSalaryInput.value = '';
    companyInput.value = '';
    directFilter.value = 'all';

    activeFilters.type = 'all';
    activeFilters.remote = 'all';
    activeFilters.date = 'all';
    activeFilters.salary = 'all';
    activeFilters.experience = 'all';
    activeFilters.minSalary = '';
    activeFilters.company = '';
    activeFilters.direct = 'all';
};

const updateFilters = () => {
    activeFilters.type = typeFilter.value;
    activeFilters.remote = remoteFilter.value;
    activeFilters.date = dateFilter.value;
    activeFilters.salary = salaryFilter.value;
    activeFilters.experience = experienceFilter.value;
    activeFilters.minSalary = minSalaryInput.value;
    activeFilters.company = companyInput.value.trim().toLowerCase();
    activeFilters.direct = directFilter.value;
    if (jobsCache.length > 0) {
        renderJobResults(jobsCache);
    }
};

const renderJobResults = (jobs) => {
    const filteredJobs = filterJobs(jobs);
    const visibleCount = filteredJobs.length;
    const totalCount = jobs.length;

    if (visibleCount === 0) {
        resultsContainer.innerHTML = `
            <div class="results-summary">
                <h2>No jobs match the current filters</h2>
                <p>Try adjusting the job type, remote status, posted date, or salary filter.</p>
            </div>
        `;
        return;
    }

    const headerText = totalCount === visibleCount
        ? `Showing ${visibleCount} job${visibleCount === 1 ? '' : 's'}`
        : `Showing ${visibleCount} of ${totalCount} job${visibleCount === 1 ? '' : 's'}`;

    resultsContainer.innerHTML = `
        <div class="results-summary">
            <h2>${headerText}</h2>
            <p>Search: <strong>${escapeHtml(query || 'All roles')}</strong> | Location: <strong>${escapeHtml(country || 'Any location')}</strong></p>
        </div>
        ${filteredJobs.map((job) => {
            const employmentType = Array.isArray(job.job_employment_types) && job.job_employment_types.length > 0
                ? job.job_employment_types.join(', ')
                : job.job_employment_type || 'Not specified';
            const locationParts = [job.job_city, job.job_state, job.job_country].filter(Boolean).join(', ') || job.job_location || 'Location not provided';
            const logoMarkup = job.employer_logo
                ? `<img class="company-logo" src="${escapeHtml(job.employer_logo)}" alt="${escapeHtml(job.employer_name || 'Company')} logo">`
                : '<div class="company-logo company-logo--placeholder">No logo</div>';

            return `
                <article class="job-card">
                    <div class="job-card__top">
                        ${logoMarkup}
                        <div>
                            <p class="job-card__publisher">${escapeHtml(job.job_publisher || 'Publisher not specified')}</p>
                            <h3>${escapeHtml(job.job_title || 'Untitled role')}</h3>
                            <p class="job-card__company">${escapeHtml(job.employer_name || 'Company not listed')}</p>
                        </div>
                    </div>

                    <div class="job-card__badges">
                        <span>${escapeHtml(employmentType)}</span>
                        <span>${job.job_is_remote ? 'Remote' : 'On-site / Hybrid'}</span>
                        <span>${escapeHtml(formatDate(job.job_posted_at_datetime_utc || job.job_posted_at))}</span>
                    </div>

                    <div class="job-card__grid">
                        <p><strong>Location:</strong> ${escapeHtml(locationParts)}</p>
                        <p><strong>Country:</strong> ${escapeHtml(job.job_country || 'Not specified')}</p>
                        <p><strong>Salary:</strong> ${escapeHtml(formatSalary(job))}</p>
                        <p><strong>Apply Direct:</strong> ${job.job_apply_is_direct ? 'Yes' : 'No'}</p>
                    </div>

                    <p class="job-card__description">${escapeHtml(buildDescriptionPreview(job.job_description))}</p>

                    <div class="job-card__actions">
                        <a class="button button--primary" href="${escapeHtml(job.job_apply_link || '#')}" target="_blank" rel="noopener noreferrer">Apply Now</a>
                        ${job.employer_website ? `<a class="button button--secondary" href="${escapeHtml(job.employer_website)}" target="_blank" rel="noopener noreferrer">Company Website</a>` : ''}
                        ${job.job_google_link ? `<a class="button button--secondary" href="${escapeHtml(job.job_google_link)}" target="_blank" rel="noopener noreferrer">View in Google Jobs</a>` : ''}
                    </div>

                    <div class="job-card__details">
                        <div>
                            <h4>Apply Options</h4>
                            <p>${escapeHtml(formatList((job.apply_options || []).map((option) => `${option.publisher}${option.is_direct ? ' (direct)' : ''}`)))}</p>
                        </div>
                        <div>
                            <h4>Highlights</h4>
                            ${renderHighlights(job.job_highlights)}
                        </div>
                    </div>
                </article>
            `;
        }).join('')}
    `;
};

const updateQuery = (event) => {
    query = event.target.value;
};

const updateCountry = (event) => {
    country = event.target.value;
};

const clearAllFilters = () => {
    resetFilters();
    queryInput.value = '';
    countryInput.value = '';
    query = '';
    country = '';

    if (jobsCache.length > 0) {
        renderJobResults(jobsCache);
        return;
    }

    resultsContainer.innerHTML = '<p class="status">Filters cleared. Search again to refresh jobs.</p>';
};

const escapeHtml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const toTitleCase = (value = '') =>
    String(value)
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

const formatDate = (value) => {
    if (!value) {
        return 'Recently posted';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const formatList = (values) => {
    if (!Array.isArray(values) || values.length === 0) {
        return 'Not specified';
    }

    return values.join(', ');
};

const formatSalary = (job) => {
    if (job.job_salary_string) {
        return job.job_salary_string;
    }

    if (job.job_min_salary && job.job_max_salary) {
        const period = job.job_salary_period ? ` / ${job.job_salary_period}` : '';
        return `${job.job_min_salary} - ${job.job_max_salary}${period}`;
    }

    return 'Salary not disclosed';
};

const buildDescriptionPreview = (description = '') => {
    const cleanText = String(description).replace(/\s+/g, ' ').trim();
    if (!cleanText) {
        return 'No description available for this job.';
    }

    return cleanText.length > 420 ? `${cleanText.slice(0, 420)}...` : cleanText;
};

const renderHighlights = (highlights) => {
    if (!highlights || typeof highlights !== 'object' || Object.keys(highlights).length === 0) {
        return '<p class="muted">No extra highlights listed by the API.</p>';
    }

    return Object.entries(highlights)
        .map(([label, values]) => {
            const items = Array.isArray(values) ? values : [values];
            return `
                <div class="highlight-group">
                    <h4>${escapeHtml(toTitleCase(label.replace(/_/g, ' ')))}</h4>
                    <p>${escapeHtml(formatList(items))}</p>
                </div>
            `;
        })
        .join('');
};

queryInput.addEventListener('input', updateQuery);

countryInput.addEventListener('input', updateCountry);

typeFilter.addEventListener('change', updateFilters);
remoteFilter.addEventListener('change', updateFilters);
dateFilter.addEventListener('change', updateFilters);
salaryFilter.addEventListener('change', updateFilters);
clearFiltersButton.addEventListener('click', clearAllFilters);
experienceFilter.addEventListener('change', updateFilters);
minSalaryInput.addEventListener('input', updateFilters);
companyInput.addEventListener('input', updateFilters);
directFilter.addEventListener('change', updateFilters);

const options = {
	method: 'GET',
	headers: {
		'x-rapidapi-key': '964ab9bfbemshf7c3a95fc2524cep1f15dbjsnbed1d3d53735',
		'x-rapidapi-host': 'jsearch.p.rapidapi.com',
		'Content-Type': 'application/json'
	}
};


const fetchJobDetails = async () => {
    try {
        resultsContainer.innerHTML = '<p class="status">Loading jobs...</p>';
		const url = `https://jsearch.p.rapidapi.com/search-v2?query=${encodeURIComponent(query.trim())}&num_pages=1&country=${encodeURIComponent(country.trim())}&date_posted=all`;
        const response = await fetch(url, options);
        const result = await response.json();

        const jobs = Array.isArray(result?.data?.jobs) ? result.data.jobs : [];
        jobsCache = jobs;

        if (jobs.length === 0) {
            resultsContainer.innerHTML = '<p class="status">No jobs found for the selected search.</p>';
            return;
        }

        renderJobResults(jobs);
    } catch (error) {
        console.error(error);
        resultsContainer.innerHTML = '<p class="status status--error">Unable to load jobs right now. Please try again.</p>';
    }
}

window.fetchJobDetails = fetchJobDetails;