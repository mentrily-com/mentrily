'use client';
import React, { useState } from 'react';
import UnitSidebar from '@/app/components/UnitSidebar';
import UnitRenderer from '@/app/components/UnitRenderer';

const sidebarUnits = [
    { id: '1', type: 'MQ', title: 'JS: Objects', done: true, active: false },
    { id: '2', type: 'Coding', title: 'JS: Object Methods', done: false, active: true },
    { id: '3', type: 'Coding', title: 'CSS Display: Float and Clear', done: false, active: false },
    { id: '4', type: 'Coding', title: 'HTML: Forms & Inputs', done: false, active: false },
];

export default function WebUnitPage() {
    const [activeTab, setActiveTab] = useState<'question' | 'attempts'>('question');
    const [showSidebar, setShowSidebar] = useState(false);

    return (
        <div className="h-screen flex flex-col bg-white overflow-hidden selection:bg-[var(--brand-light)]">
            <div className="flex-1 flex overflow-hidden">
                <UnitRenderer
                    question={{
                        id: '2',
                        type: 'Web',
                        title: 'JS: Object Methods',
                        description:
                            'Methods are actions that can be performed on objects. Object methods are properties containing a function definition. In this task, you will create an object with a method that calculates a value based on its properties.',
                        topic: 'JavaScript Objects',
                        difficulty: 'Medium',
                        webConfig: {
                            initialHTML: `<!-- Insert HTML Body Content Here! -->\n\n<div id="output">Full name will appear here......</div>`,
                            initialCSS: `#output {\n  padding: 20px;\n  margin-top: 20px;\n  border: 2px solid var(--brand);\n  border-radius: 8px;\n  font-family: sans-serif;\n  color: #334155;\n  font-weight: bold;\n}`,
                            initialJS: `const person = {\n  firstName: "John",\n  lastName: "Doe",\n  getFullName: function() {\n    return this.firstName + " " + this.lastName;\n  }\n};\n\n// Display the name\ndocument.getElementById("output").innerText = person.getFullName();`,
                            showFiles: { html: true, css: true, js: true },
                        },
                    }}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    showSidebar={showSidebar}
                    onToggleSidebar={() => setShowSidebar(!showSidebar)}
                    sidebar={
                        <UnitSidebar
                            units={sidebarUnits}
                            moduleTitle="Frontend Development"
                            sectionTitle="JavaScript Essentials"
                            onToggle={() => setShowSidebar(false)}
                        />
                    }
                />
            </div>
        </div>
    );
}
