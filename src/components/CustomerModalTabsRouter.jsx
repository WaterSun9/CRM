import React from 'react';
import LeadsTab from './modal-tabs/LeadsTab';
import RegistrationTab from './modal-tabs/RegistrationTab';
import LoanTab from './modal-tabs/LoanTab';
import CashTab from './modal-tabs/CashTab';
import MaterialOrderTab from './modal-tabs/MaterialOrderTab';
import MaterialIntegrationTab from './modal-tabs/MaterialIntegrationTab';
import HoldProcurementTab from './modal-tabs/HoldProcurementTab';
import MaterialDeliveryTab from './modal-tabs/MaterialDeliveryTab';
import InstallationStatusTab from './modal-tabs/InstallationStatusTab';
import GeoTagPhotoTab from './modal-tabs/GeoTagPhotoTab';
import DiscomSubmissionTab from './modal-tabs/DiscomSubmissionTab';
import MeterInstallationTab from './modal-tabs/MeterInstallationTab';
import DiscomInspectionTab from './modal-tabs/DiscomInspectionTab';
import SubsidyStatusTab from './modal-tabs/SubsidyStatusTab';
import FinalReviewTab from './modal-tabs/FinalReviewTab';

export default function CustomerModalTabsRouter(props) {
    const { activeTab } = props;

    return (
        <>
            {activeTab === 'LEADS' && <LeadsTab {...props} />}
            {activeTab === 'REGISTRATION' && <RegistrationTab {...props} />}
            {activeTab === 'LOAN' && <LoanTab {...props} />}
            {activeTab === 'CASH' && <CashTab {...props} />}
            {activeTab === 'MATERIAL ORDER' && <MaterialOrderTab {...props} />}
            {activeTab === 'MATERIAL INTEGRATION' && <MaterialIntegrationTab {...props} />}
            {activeTab === 'HOLD PROCUREMENT' && <HoldProcurementTab {...props} />}
            {activeTab === 'MATERIAL DELIVERY' && <MaterialDeliveryTab {...props} />}
            {activeTab === 'INSTALLATION STATUS' && <InstallationStatusTab {...props} />}
            {activeTab === 'GEO TAG PHOTO' && <GeoTagPhotoTab {...props} />}
            {activeTab === 'DISCOM SUBMISSION' && <DiscomSubmissionTab {...props} />}
            {activeTab === 'METER INSTALLATION' && <MeterInstallationTab {...props} />}
            {activeTab === 'DISCOM INSPECTION' && <DiscomInspectionTab {...props} />}
            {activeTab === 'SUBSIDY STATUS' && <SubsidyStatusTab {...props} />}
            {activeTab === 'FINAL REVIEW' && <FinalReviewTab {...props} />}
        </>
    );
}
