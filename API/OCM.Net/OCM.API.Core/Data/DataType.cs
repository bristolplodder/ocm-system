//------------------------------------------------------------------------------
// <auto-generated>
//    This code was generated from a template.
//
//    Manual changes to this file may cause unexpected behavior in your application.
//    Manual changes to this file will be overwritten if the code is regenerated.
// </auto-generated>
//------------------------------------------------------------------------------

namespace OCM.Core.Data
{
    using System;
    using System.Collections.Generic;
    
    public partial class DataType
    {
        public DataType()
        {
            this.MetadataFields = new HashSet<MetadataField>();
            this.SystemConfigs = new HashSet<SystemConfig>();
        }
    
        public byte ID { get; set; }
        public string Title { get; set; }
    
        public virtual ICollection<MetadataField> MetadataFields { get; set; }
        public virtual ICollection<SystemConfig> SystemConfigs { get; set; }
    }
}
