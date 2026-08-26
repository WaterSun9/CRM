const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `{isExpanded ? 'Hide project details' : \`View \${linkedProjects.length} drop-off locations\`}
                                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>
                                </div>

                                {/* Expandable Project Drop-Off Table */}`;

const replacement = `{isExpanded ? 'Hide project details' : \`View \${linkedProjects.length} drop-off locations\`}
                                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>
                                    </div>
                                </div>

                                {/* Expandable Project Drop-Off Table */}`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed missing closing div.");
