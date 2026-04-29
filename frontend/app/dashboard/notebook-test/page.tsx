'use client';
import React from 'react';
import UnitRenderer, { UnitQuestion } from '@/app/components/UnitRenderer';
import Navbar from '@/app/components/Navbar';

export default function NotebookTestPage() {
    const notebookQuestion: UnitQuestion = {
        id: 'unit-6-notebook',
        type: 'Notebook',
        title: 'Unit 6: Data Visualization with Matplotlib',
        description: `
            <h3>Working with Plots in Python</h3>  
            <p>In this unit, we will explore how to generate simple data visualizations using the <code>matplotlib</code> library.</p>
            <p><strong>Task:</strong></p>
            <ul>
                <li>Import <code>numpy</code> and <code>matplotlib.pyplot</code>.</li>
                <li>Create a linearly spaced array <code>x</code> from 0 to 10 with 100 points.</li>
                <li>Calculate <code>y = sin(x)</code>.</li>
                <li>Plot the sine wave and add a title.</li>
            </ul>
        `,
        notebookConfig: {
            initialCode: `import matplotlib.pyplot as plt
import numpy as np

# Create data
x = np.linspace(0, 10, 100)
y = np.sin(x)

# Plot
plt.figure()
plt.plot(x, y, color='blue', label='sin(x)')
plt.title("My First Sine Wave")
plt.legend()
plt.grid(True)
plt.show()`,
            language: 'python',
        },
    };

    return (
        <div className="h-screen flex flex-col bg-[#F8FAFC]">
            <Navbar />
            <div className="flex-1 overflow-hidden">
                <UnitRenderer question={notebookQuestion} activeTab="question" />
            </div>
        </div>
    );
}
